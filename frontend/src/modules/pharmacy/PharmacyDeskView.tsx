import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scan, CheckCircle2, AlertTriangle, Printer, ShieldAlert, Pill, Loader2, XCircle, Leaf, Check, Undo2, PackageCheck, PackageMinus, ArrowRight, Info, PencilLine, BookOpenCheck } from 'lucide-react';
import { ConflictAlert, PharmacyDispenseItem } from '../../types/api';
import { sovereignSound } from '../../utils/audio';
import { api, apiFetch, BASE_URL } from '../../services/api';
import { printElement } from '../../utils/printDocument';
import { buildInstruction, LANGUAGE_NATIVE_NAME, RxLang, isRxLang } from '../../utils/rxInstructions';
import { HOSPITAL } from '../../utils/hospitalConfig';
import { lookAlike, LookAlike } from '../../utils/tallMan';
import { H1RegisterDialog } from './H1RegisterDialog';

type Rx = PharmacyDispenseItem;
type RecordStatus = 'DISPENSED' | 'PARTIAL' | 'NOT_DISPENSED' | 'REFERRED_BACK';

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING_VERIFICATION: { text: 'Waiting', cls: 'bg-sky-500/10 text-sky-700' },
  DISPENSED: { text: 'All given', cls: 'bg-emerald-500/15 text-emerald-700' },
  PARTIAL: { text: 'Partly given', cls: 'bg-amber-500/15 text-amber-700' },
  NOT_DISPENSED: { text: 'Not given', cls: 'bg-rose-500/15 text-rose-700' },
  REFERRED_BACK: { text: 'Sent back to doctor', cls: 'bg-rose-500/15 text-rose-700' }
};
const REPLACED = { text: 'Replaced', cls: 'bg-muted text-muted-foreground' };

const LABEL_LANGS: RxLang[] = ['hi', 'en', 'mr', 'bn', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'or'];
const GENDER: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };

const isCritical = (a: { severity?: unknown; tier?: unknown }) => a.tier === 'STOP' || /CRITICAL/.test(String(a.severity));
/** Older records carry the pair and the advice under different field names. */
const alertText = (a: ConflictAlert) => {
  const old = a as { drugName?: string; warningMessage?: string };
  const pair = [a.itemA || a.allopathicDrug || old.drugName, a.itemB || a.ayushHerb].filter(Boolean).join(' × ');
  const what = a.clinicalAction || a.recommendedAction || a.mechanism || a.clinicalConsequence || old.warningMessage || 'Details not recorded — check with the doctor.';
  return <>{pair && <strong>{pair}: </strong>}{what}</>;
};

// 24-hour times and unambiguous dates ("10 Oct 2026"): a counter must never have to guess AM/PM or day/month.
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const whenShort = (iso: string) => isToday(iso) ? timeOf(iso) : `${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${timeOf(iso)}`;
const whenFull = (iso: string) => `${dateOf(iso)}, ${timeOf(iso)}`;
const num = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);
const norm = (s?: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Doses in the course, for counting at the counter: "TDS × 5 days = 15", "1-0-1 × 10 days = 20".
 * Only when the frequency says how many a day (not SOS / "as needed") and the duration is known.
 */
function courseCount(frequency?: string, durationDays?: number): { total: number; unit: 'doses' | 'units' } | null {
  const f = (frequency || '').toLowerCase();
  if (!f || !durationDays || durationDays <= 0 || /\bsos\b|as needed|when needed|prn/.test(f)) return null;
  const pat = f.match(/(\d(?:\.\d)?|½)\s*[-–]\s*(\d(?:\.\d)?|½)\s*[-–]\s*(\d(?:\.\d)?|½)/);
  if (pat) {
    const perDay = [pat[1], pat[2], pat[3]].reduce((s, x) => s + (x === '½' ? 0.5 : Number(x)), 0);
    return perDay > 0 ? { total: perDay * durationDays, unit: 'units' } : null;
  }
  const perDay = /\bqid\b|four times/.test(f) ? 4 : /\btds\b|\btid\b|thrice|three times/.test(f) ? 3 : /\bbd\b|\bbid\b|twice/.test(f) ? 2
    : /\bod\b|\bhs\b|once|bedtime/.test(f) ? 1 : 0;
  return perDay ? { total: perDay * durationDays, unit: 'doses' } : null;
}

/** One medicine on the prescription, as the counter needs it. */
interface Line {
  kind: 'allo' | 'ayush';
  name: string;
  detail: string;
  /** Free-text instruction the doctor wrote for this medicine. */
  instructions: string;
  /** How many to give for the course. */
  qty: number | null;
  /** 'quantity' when it is the figure on the signed record; otherwise counted here from frequency × days. */
  qtyNote: string;
  onRecord: boolean;
  /** Patient-language dosing line for the label (null when the frequency cannot be rendered exactly). */
  instr: string | null;
  /** Schedule E(1) ingredients, when the formulation has any. */
  e1: string[] | null;
  /** 'Schedule H1' or 'NDPS' when a register entry is needed. */
  register: string | null;
  look: LookAlike | null;
  /** Named in an interaction alert on this prescription. */
  alert: 'stop' | 'warn' | null;
}

/** Small uppercase heading used for every block of the counter, so the page reads as one system. */
const SectionTitle: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="flex items-center justify-between gap-2 mb-2">
    <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{children}</h3>
    {right}
  </div>
);

/** One line of the "before handing over" checklist. */
const CheckRow: React.FC<{ state: 'ok' | 'stop' | 'warn' | 'info' | 'pending'; title: React.ReactNode; children?: React.ReactNode }> = ({ state, title, children }) => {
  const icon = state === 'ok' ? <CheckCircle2 size={16} className="text-emerald-600" />
    : state === 'stop' ? <ShieldAlert size={16} className="text-rose-600" />
    : state === 'warn' ? <AlertTriangle size={16} className="text-amber-600" />
    : state === 'info' ? <Info size={16} className="text-sky-600" />
    : <Loader2 size={16} className="animate-spin text-muted-foreground" />;
  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 ${state === 'stop' ? 'bg-rose-500/[0.07]' : ''}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold ${state === 'stop' ? 'text-rose-800' : 'text-foreground'}`}>{title}</div>
        {children && <div className="mt-1 space-y-1 text-xs">{children}</div>}
      </div>
    </div>
  );
};

/** A short tag under a medicine, at the point of picking. */
const LineTag: React.FC<{ tone: 'rose' | 'amber' | 'violet'; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-block mt-1 mr-1 px-1.5 py-0.5 rounded-md border text-[11px] font-semibold ${
    tone === 'rose' ? 'border-rose-500/50 bg-rose-500/10 text-rose-800' : tone === 'violet' ? 'border-violet-500/50 bg-violet-500/10 text-violet-900' : 'border-amber-500/50 bg-amber-500/10 text-amber-900'}`}>
    {children}
  </span>
);

/**
 * The dose label, used for the on-screen preview and for printing (inline styles only: the print
 * window copies the markup, not the app's stylesheet).
 */
const DoseLabel: React.FC<{ rx: Rx; line: Line; lang: RxLang; preview?: boolean }> = ({ rx, line, lang, preview }) => (
  <div style={{ border: '1px solid #94a3b8', borderRadius: 6, padding: 8, marginBottom: preview ? 0 : 8, pageBreakInside: 'avoid', width: '100%', maxWidth: 320, background: '#fff', color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>
    <div style={{ fontSize: 9, color: '#475569' }}>{HOSPITAL.name} · {rx.prescriptionToken}</div>
    <div style={{ fontSize: 13, fontWeight: 800 }}>{line.name}</div>
    <div style={{ fontSize: 11 }}>{rx.patientName} · {dateOf(rx.prescribedAt)}{line.onRecord && line.qty ? ` · Qty ${num(line.qty)}` : ''}</div>
    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{line.instr || line.detail}</div>
    {line.e1 && (
      <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, paddingTop: 3, borderTop: '1px solid #94a3b8' }}>
        Caution: To be taken under medical supervision<br />सावधानी: केवल चिकित्सक की देखरेख में लें
      </div>
    )}
    {preview && !line.instr && lang !== 'en' && <div style={{ fontSize: 9, color: '#b45309' }}>Instruction not translatable automatically — explain to the patient.</div>}
  </div>
);

/**
 * Pharmacy counter: signed prescriptions arrive from the doctor desk. The pharmacist checks the
 * doctor's seal, the safety warnings and what is known about the patient, confirms who is at the
 * counter, picks each medicine (with the quantity for the course), prints dose labels in the
 * patient's language and records what was handed over, line by line.
 * Hand-over is only possible once the checks allow it; "Send back to doctor" is always possible.
 */
export const PharmacyDeskView: React.FC = () => {
  const [queue, setQueue] = useState<Rx[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verification, setVerification] = useState<Record<string, { valid: boolean; reason?: string } | 'checking'>>({});
  const [labelLang, setLabelLang] = useState<RxLang>('hi');
  /** Lines the pharmacist has ticked as picked, per prescription. */
  const [picked, setPicked] = useState<Record<string, number[]>>({});
  /** Batch numbers typed for register medicines, per prescription and line. */
  const [batch, setBatch] = useState<Record<string, Record<number, string>>>({});
  /** Quantity actually supplied, for Schedule H1 / NDPS lines (it goes into the register). */
  const [qtyGiven, setQtyGiven] = useState<Record<string, Record<number, string>>>({});
  /** Patient identity confirmed at the counter (name + token), per prescription. */
  const [identified, setIdentified] = useState<Record<string, boolean>>({});
  /** Labels left out of printing, per prescription (by line index). */
  const [skipLabel, setSkipLabel] = useState<Record<string, number[]>>({});
  /** A recorded prescription whose record is being corrected. */
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);
  const knownIds = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      // Read the queue directly: a network blip must keep the last list on screen, not empty the counter.
      const res = await apiFetch(`${BASE_URL}/api/doctor/encounters`);
      if (!res.ok) throw new Error(`queue ${res.status}`);
      const body = await res.json();
      const items: Rx[] = body?.success && Array.isArray(body.data) ? body.data : [];
      const replaced = new Set(items.map(i => i.amendsEncounterId).filter(Boolean) as string[]);
      const waiting = items.filter(i => i.dispenseStatus === 'PENDING_VERIFICATION' && !replaced.has(i.id));
      // A new prescription arrived while the counter was open.
      if (knownIds.current && waiting.some(i => !knownIds.current!.has(i.id))) sovereignSound('chime');
      knownIds.current = new Set(items.map(i => i.id));
      setQueue(items);
      setOnline(true);
      setSelectedId(prev => (prev && items.some(i => i.id === prev) ? prev : (waiting[0] || items[0])?.id || null));
    } catch {
      setOnline(false);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  /** An amended prescription replaces the earlier one for the visit: earlier id → the one that replaced it. */
  const supersededBy = useMemo(() => {
    const m = new Map<string, Rx>();
    for (const q of queue) {
      const prev = q.amendsEncounterId;
      if (!prev) continue;
      const cur = m.get(prev);
      if (!cur || cur.prescribedAt < q.prescribedAt) m.set(prev, q);
    }
    return m;
  }, [queue]);

  const selected = queue.find(q => q.id === selectedId) || null;
  const isWaiting = (q: Rx) => q.dispenseStatus === 'PENDING_VERIFICATION' && !supersededBy.has(q.id);
  const pending = queue.filter(isWaiting);
  const done = queue.filter(q => !isWaiting(q));
  const shown = tab === 'pending' ? pending : done;

  // Check the doctor's digital signature whenever a prescription is opened.
  useEffect(() => {
    if (!selected || verification[selected.id]) return;
    setVerification(v => ({ ...v, [selected.id]: 'checking' }));
    api.verifyEncounterSignature(selected.id)
      .then(r => setVerification(v => ({ ...v, [selected.id]: r })))
      .catch(() => setVerification(v => ({ ...v, [selected.id]: { valid: false, reason: 'Could not reach the server to check the signature.' } })));
  }, [selected, verification]);

  // A note or a correction belongs to one prescription: never carry it to the next one.
  const selectedLanguage = selected?.language;
  useEffect(() => {
    setNote('');
    setActionError('');
    setCorrecting(null);
    if (isRxLang(selectedLanguage)) setLabelLang(selectedLanguage as RxLang);
  }, [selectedId, selectedLanguage]);

  const open = (item: Rx) => {
    setSelectedId(item.id);
    setTab(isWaiting(item) ? 'pending' : 'done');
    setMessage(null);
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim().toUpperCase();
    if (!q) return;
    const matches = queue.filter(i => i.prescriptionToken.toUpperCase().includes(q) || i.patientName.toUpperCase().includes(q) || i.id.toUpperCase().startsWith(q.replace(/^RX\|/, '')));
    const found = matches.find(isWaiting) || matches[0];
    if (found) {
      sovereignSound('chime');
      open(found);
      setSearch('');
    } else {
      sovereignSound('alert');
      setMessage({ tone: 'error', text: `No prescription found for "${search.trim()}" in the last 3 days.` });
    }
  };

  const ver = selected ? verification[selected.id] : undefined;
  const sigState: 'checking' | 'valid' | 'invalid' = !ver || ver === 'checking' ? 'checking' : ver.valid ? 'valid' : 'invalid';
  const replacedBy = selected ? supersededBy.get(selected.id) : undefined;
  const earlier = selected?.amendsEncounterId ? queue.find(q => q.id === selected.amendsEncounterId) : undefined;
  const earlierGiven = !!earlier && (earlier.dispenseStatus === 'DISPENSED' || earlier.dispenseStatus === 'PARTIAL');
  const isOpen = !!selected && selected.dispenseStatus === 'PENDING_VERIFICATION' && !replacedBy;
  const correctingThis = !!selected && correcting === selected.id;
  const canRecord = isOpen || correctingThis;

  const e1Items = selected?.scheduleE1PoisonVerification?.items || [];
  const hasE1 = !!selected?.scheduleE1PoisonVerification?.containsScheduleE1;
  const scheduleH1 = selected?.scheduleH1 || [];
  const alerts = selected?.conflictAlerts || [];
  const criticalAlerts = alerts.filter(isCritical);
  // The Schedule E(1) notice below already says what to do; INFO-tier notes are folded.
  const warnAlerts = alerts.filter(a => !isCritical(a) && a.tier !== 'INFO' && !(hasE1 && a.severity === 'STATUTORY_SCHEDULE_E1'));
  const infoAlerts = alerts.filter(a => !isCritical(a) && a.tier === 'INFO' && !(hasE1 && a.severity === 'STATUTORY_SCHEDULE_E1'));
  const acknowledged = selected?.acknowledgedAlerts || [];
  const diagnoses = selected?.diagnoses || [];
  const unreasonedCritical = criticalAlerts.length > 0 && acknowledged.length === 0;
  const warningCount = criticalAlerts.length + warnAlerts.length + (hasE1 ? 1 : 0) + (scheduleH1.length ? 1 : 0);

  // What the safety checks knew about the patient when the doctor signed.
  const ctx = selected?.patientContext || null;
  const checks = selected?.safetyChecks || [];
  const allergyCheck = checks.find(c => c.check === 'allergy');
  /** Recorded allergies; [] = asked and none; null = never asked, so nothing could be checked. */
  const allergyList: string[] | null = ctx?.allergies ? ctx.allergies.map(a => (a.reaction ? `${a.agent} (${a.reaction})` : a.agent))
    : allergyCheck?.ran ? (/^no known/i.test(allergyCheck.detail || '') ? [] : (allergyCheck.detail || '').split(/,\s*/).filter(Boolean))
    : null;
  const toAsk: string[] = [];
  if (selected && allergyList === null) toAsk.push('Any allergy to a medicine? Not recorded at check-in, so nothing was checked against allergies.');
  if (ctx?.pregnancy === 'unknown') toAsk.push('Could she be pregnant? Not answered at check-in.');
  const notChecked = selected?.notChecked || [];
  const renalMissing = checks.some(c => c.check === 'renal_gate' && !c.ran);

  const lines: Line[] = useMemo(() => {
    if (!selected) return [];
    const flagged = (...names: Array<string | undefined>): Line['alert'] => {
      const keys = names.map(norm).filter(k => k.length >= 4);
      const hit = (a: ConflictAlert) => [a.itemA, a.itemB, a.allopathicDrug, a.ayushHerb].map(norm).some(x => x.length >= 4 && keys.some(k => x.includes(k) || k.includes(x)));
      const all = selected.conflictAlerts || [];
      return all.some(a => isCritical(a) && hit(a)) ? 'stop' : all.some(a => !isCritical(a) && a.tier !== 'INFO' && hit(a)) ? 'warn' : null;
    };
    const e1 = selected.scheduleE1PoisonVerification?.items || [];
    const h1 = selected.scheduleH1 || [];
    return [
      ...selected.allopathicMeds.map((m): Line => {
        const count = courseCount(m.frequency, m.durationDays);
        const reg = h1.find(x => norm(x.medicine) === norm(m.name));
        return {
          kind: 'allo', name: m.name || '',
          detail: [m.dosage, m.frequency, m.durationDays ? `${m.durationDays} days` : '', m.route && m.route !== 'ORAL' ? m.route.toLowerCase() : '', m.indication ? `for ${m.indication}` : ''].filter(Boolean).join(' · '),
          instructions: m.instructions || '',
          qty: Number(m.quantity) > 0 ? Number(m.quantity) : count ? count.total : null,
          qtyNote: Number(m.quantity) > 0 ? 'quantity' : count ? `${count.unit} for the course` : '',
          onRecord: Number(m.quantity) > 0,
          instr: buildInstruction({ dose: m.dosage, frequency: m.frequency, durationDays: m.durationDays }, labelLang),
          e1: null,
          register: reg ? (reg.ndps ? 'NDPS' : 'Schedule H1') : null,
          look: lookAlike(m.genericName, m.name),
          alert: flagged(m.name, m.genericName)
        };
      }),
      ...selected.ayushFormulations.map((a): Line => {
        const count = courseCount(a.frequency, a.durationDays);
        const poison = e1.find(x => norm(x.name) === norm(a.classicalName));
        return {
          kind: 'ayush', name: a.classicalName || '',
          detail: [a.dose, a.dosageForm, a.frequency, a.durationDays ? `${a.durationDays} days` : '', a.anupana ? `with ${a.anupana}` : ''].filter(Boolean).join(' · '),
          instructions: '',
          qty: Number(a.quantity) > 0 ? Number(a.quantity) : count ? count.total : null,
          qtyNote: Number(a.quantity) > 0 ? 'quantity' : count ? `${count.unit} for the course` : '',
          onRecord: Number(a.quantity) > 0,
          instr: buildInstruction({ dose: a.dose, frequency: a.frequency, durationDays: a.durationDays, anupana: a.anupana }, labelLang),
          e1: poison ? poison.ingredients : null,
          register: null,
          look: null,
          alert: flagged(a.classicalName)
        };
      })
    ];
  }, [selected, labelLang]);

  const pickedHere = selected ? picked[selected.id] || [] : [];
  const batchHere = selected ? batch[selected.id] || {} : {};
  const qtyHere = selected ? qtyGiven[selected.id] || {} : {};
  /** What goes on record as supplied: the typed figure for a register line, else the prescription's quantity. */
  const suppliedQty = (i: number): number | null => {
    const typed = Number(qtyHere[i]);
    return typed > 0 ? typed : lines[i]?.qty ?? null;
  };
  const notPicked = lines.filter((_, i) => !pickedHere.includes(i)).map(l => l.name || 'unnamed line');
  const someTicked = pickedHere.length > 0 && notPicked.length > 0;
  const unnamedCount = lines.filter(l => !l.name).length;
  const isIdentified = !!(selected && identified[selected.id]);
  const skippedHere = selected ? skipLabel[selected.id] || [] : [];
  // A label is never printed for a line without a medicine name.
  const printable = lines.map((line, i) => ({ line, i })).filter(({ line, i }) => !!line.name && !skippedHere.includes(i));

  const toggleIn = (set: React.Dispatch<React.SetStateAction<Record<string, number[]>>>, i: number) => {
    if (!selected) return;
    set(p => {
      const cur = p[selected.id] || [];
      return { ...p, [selected.id]: cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i] };
    });
    setActionError('');
  };

  // What may happen at the counter now. Sending back is always allowed; handing anything over needs a valid
  // seal, a doctor's reason for every serious alert, and the patient's identity confirmed.
  const handOverBlock = sigState === 'checking' ? 'Checking the doctor’s seal…'
    : sigState === 'invalid' ? 'The seal is broken — send it back to the doctor; nothing can be handed over.'
    : unreasonedCritical ? 'A serious alert has no reason from the doctor — confirm with the doctor first.'
    : !isIdentified && !correctingThis ? 'Confirm the patient’s name and token first.'
    : null;
  const allGivenBlock = handOverBlock
    || (unnamedCount > 0 ? 'A medicine has no name — it cannot be handed over.' : null)
    || (someTicked ? `${notPicked.length} not ticked — tick ${notPicked.length === 1 ? 'it' : 'them'}, or record “Partly given”.` : null);

  const record = async (status: RecordStatus) => {
    if (!selected || !canRecord) return;
    if ((status === 'DISPENSED' && allGivenBlock) || (status === 'PARTIAL' && handOverBlock)) return;
    const typed = note.trim();
    // A partly-given record names what was not given; the ticks fill that in when the note is empty.
    let text = typed || (status === 'PARTIAL' && someTicked ? `Not given: ${notPicked.join(', ')}` : '');
    if (correctingThis && typed.length < 5) { setActionError('Write what is being corrected, and why.'); return; }
    if (status === 'PARTIAL' && !text) { setActionError('Tick what was given, or write which medicine was not given.'); return; }
    if (status === 'REFERRED_BACK' && text.length < 5) { setActionError('Write why it goes back to the doctor.'); return; }
    // The Schedule H1 register needs the quantity supplied for every register medicine that is handed over.
    const noQty = lines.findIndex((l, i) => !!l.register && !!l.name && (status === 'DISPENSED' || (status === 'PARTIAL' && pickedHere.includes(i))) && suppliedQty(i) === null);
    if (noQty >= 0) { setActionError(`Enter the quantity given for ${lines[noQty].name} — it goes into the Schedule H1 register.`); return; }
    const batches = lines.map((l, i) => (batchHere[i]?.trim() ? `${l.name} batch ${batchHere[i].trim()}` : '')).filter(Boolean);
    if (status !== 'REFERRED_BACK' && batches.length) text = [text, batches.join('; ')].filter(Boolean).join(' · ');
    if (correctingThis) text = `Correction: ${text}`;
    // What was handed over, line by line (only when that is known: everything, or the ticked lines).
    const given = status === 'DISPENSED' || (status === 'PARTIAL' && pickedHere.length > 0)
      ? lines.map((l, i) => ({ name: l.name || 'unnamed line', given: status === 'DISPENSED' || pickedHere.includes(i), quantity: suppliedQty(i) ?? undefined, batch: batchHere[i]?.trim() || undefined }))
      : undefined;
    setBusy(true);
    setActionError('');
    try {
      await api.recordDispense(selected.id, status, text || undefined, given);
      sovereignSound('chime');
      setMessage({ tone: 'ok', text: `Recorded for ${selected.patientName}: ${STATUS_LABEL[status].text.toLowerCase()}.` });
      setCorrecting(null);
      setNote('');
      await load();
    } catch (e: any) {
      setActionError(e?.message || 'Could not save — check the connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  /** A correction starts from what was recorded: the same ticks, quantities and batch numbers. */
  const startCorrection = () => {
    if (!selected) return;
    const recorded = (name: string) => (selected.dispensedItems || []).find(g => norm(g.name) === norm(name));
    const byLine = <T,>(pick: (g: NonNullable<ReturnType<typeof recorded>>) => T | undefined) =>
      Object.fromEntries(lines.map((l, i) => [i, recorded(l.name)]).filter(([, g]) => g && pick(g as any) !== undefined).map(([i, g]) => [i, String(pick(g as any))]));
    if (selected.dispensedItems?.length) {
      setPicked(p => ({ ...p, [selected.id]: lines.map((l, i) => (recorded(l.name)?.given ? i : -1)).filter(i => i >= 0) }));
      setBatch(v => ({ ...v, [selected.id]: byLine(g => g.batch) }));
      setQtyGiven(v => ({ ...v, [selected.id]: byLine(g => (g.given ? g.quantity : undefined)) }));
    }
    setCorrecting(selected.id);
  };

  const nextWaiting = pending.find(p => p.id !== selectedId);
  const statusOf = (q: Rx) => (supersededBy.has(q.id) && q.dispenseStatus === 'PENDING_VERIFICATION' ? REPLACED : STATUS_LABEL[q.dispenseStatus] || STATUS_LABEL.PENDING_VERIFICATION);

  return (
    <div className="max-w-[1480px] mx-auto px-3 sm:px-5 py-4 space-y-3">
      {/* Summary strip and the first thing done at the counter: find the prescription. The screen name is in the top bar. */}
      <div className="rounded-2xl border border-border/80 bg-card px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span><strong className="text-base font-extrabold tabular-nums text-foreground">{pending.length}</strong> to dispense</span>
          <span><strong className="text-base font-extrabold tabular-nums text-foreground">{done.length}</strong> done</span>
          <span className="hidden md:inline">Signed prescriptions from the last 3 days</span>
          {!online && (
            <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-rose-500/15 text-rose-700 font-semibold" role="status">
              Server unreachable — showing the last list
              <button type="button" onClick={load} className="underline underline-offset-2 font-bold">Retry</button>
            </span>
          )}
        </div>
        <form onSubmit={onSearch} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Scan size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary" />
            {/* A QR scanner types like a keyboard, so the field is ready as soon as the counter opens. */}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Scan Rx QR, or type token / name" aria-label="Find prescription"
              autoFocus={typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches}
              className="w-full sm:w-80 h-10 pl-8 pr-3 rounded-lg border border-border bg-background text-sm" />
          </div>
          <button type="submit" className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Find</button>
          <button type="button" onClick={() => setRegisterOpen(true)} className="h-10 px-3 rounded-lg border border-border bg-background hover:bg-muted text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap" title="Schedule H1 / NDPS supplies: prescriber, patient, medicine, quantity">
            <BookOpenCheck size={14} /> H1 register
          </button>
        </form>
      </div>

      {message && (
        <div className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${message.tone === 'ok' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800' : 'bg-rose-500/10 border-rose-500/40 text-rose-700'}`} role="status">
          <span>{message.text}</span>
          <span className="flex items-center gap-1.5 shrink-0">
            {message.tone === 'ok' && nextWaiting && (
              <button type="button" onClick={() => open(nextWaiting)} className="h-8 px-2.5 rounded-lg bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1">
                Next prescription <ArrowRight size={13} />
              </button>
            )}
            <button type="button" onClick={() => setMessage(null)} className="h-8 w-8 rounded-lg hover:bg-background/60 inline-flex items-center justify-center" aria-label="Dismiss"><XCircle size={14} /></button>
          </span>
        </div>
      )}

      <div className="pharmacy-grid">
        {/* Queue */}
        <nav aria-label="Prescriptions" className="pharmacy-pane rounded-2xl border border-border/80 bg-card p-3 flex flex-col">
          <div className="flex gap-0.5 p-0.5 mb-2.5 rounded-xl bg-muted/60 border border-border/70" role="tablist">
            {([{ id: 'pending', label: 'To dispense', n: pending.length }, { id: 'done', label: 'Done', n: done.length }] as const).map(t => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`flex-1 h-9 rounded-lg text-xs font-bold ${tab === t.id ? 'bg-card shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {t.label} <span className="font-semibold tabular-nums opacity-70">{t.n}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
            {!loaded ? <div className="py-8 text-center text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin inline mr-1" /> Loading…</div>
              : shown.length === 0 ? <div className="py-8 px-2 text-center text-xs text-muted-foreground">{tab === 'pending' ? 'Nothing waiting. A new prescription appears here as soon as the doctor signs it.' : 'Nothing recorded in the last 3 days.'}</div>
              : shown.map(item => {
                const st = statusOf(item);
                const critical = (item.conflictAlerts || []).some(isCritical);
                const active = selectedId === item.id;
                const count = item.allopathicMeds.length + item.ayushFormulations.length;
                return (
                  <button key={item.id} type="button" onClick={() => { sovereignSound('notch'); open(item); }} aria-current={active ? 'true' : undefined}
                    className={`w-full text-left pl-3 pr-2.5 py-2 rounded-xl border border-l-4 transition-colors ${critical && tab === 'pending' ? 'border-l-rose-500' : 'border-l-transparent'} ${active ? 'border-primary bg-primary/5' : 'border-border/70 bg-background hover:bg-muted/50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold truncate">{item.patientName}</span>
                      {tab === 'done'
                        ? <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 ${st.cls}`}>{st.text}</span>
                        : <span className="text-[11px] font-mono text-muted-foreground shrink-0">{whenShort(item.prescribedAt)}</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate"><span className="font-mono">{item.prescriptionToken}</span> · {count === 0 ? 'advice only' : `${count} medicine${count === 1 ? '' : 's'}`} · {item.doctorName}</div>
                    {tab === 'pending' && (critical || item.amendsEncounterId) && (
                      <div className="text-[11px] font-bold flex items-center gap-2 mt-0.5">
                        {critical && <span className="text-rose-600 inline-flex items-center gap-1"><AlertTriangle size={11} /> Serious alert</span>}
                        {item.amendsEncounterId && <span className="text-sky-700">Amended</span>}
                      </div>
                    )}
                  </button>
                );
              })}
          </div>
        </nav>

        {/* Prescription being dispensed */}
        <main aria-label="Prescription" className="rounded-2xl border border-border/80 bg-card min-h-[300px] min-w-0 flex flex-col">
          {!selected ? <div className="py-16 text-center text-sm text-muted-foreground">{loaded && queue.length === 0 ? 'No prescriptions in the last 3 days.' : 'Select a prescription, or scan its QR code.'}</div> : (
            <>
              <div className="p-4 space-y-4 flex-1">
                <header className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold leading-tight flex items-baseline gap-x-2 gap-y-1 flex-wrap">
                      {selected.patientName}
                      <span className="text-xs font-medium text-muted-foreground">{selected.age} y · {GENDER[selected.gender] || selected.gender}{ctx?.weightKg && selected.age < 12 ? ` · ${ctx.weightKg} kg` : ''}</span>
                      {ctx?.pregnancy === 'yes' && <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-800 text-[11px] font-bold">Pregnant{ctx.gestationalWeeks ? ` · ${ctx.gestationalWeeks} wk` : ''}</span>}
                      {ctx?.lactating && <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-800 text-[11px] font-bold">Breastfeeding</span>}
                    </h2>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Token <span className="font-mono font-bold text-foreground">{selected.prescriptionToken}</span> · {selected.doctorName}{selected.doctorRegistration ? ` (${selected.doctorRegistration})` : ''}
                      {selected.roomNumber ? ` · ${/^\d/.test(selected.roomNumber) ? `Room ${selected.roomNumber}` : selected.roomNumber}` : ''} · signed {whenFull(selected.prescribedAt)}
                    </div>
                    {diagnoses.length > 0 && <div className="text-xs mt-1"><span className="text-muted-foreground">Diagnosis:</span> <strong>{diagnoses.join(', ')}</strong></div>}
                  </div>
                  {!isOpen && <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusOf(selected).cls}`}>{statusOf(selected).text}</span>}
                </header>

                {replacedBy && (
                  <div role="alert" className="rounded-xl border border-rose-500/50 bg-rose-500/[0.07] px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-semibold text-rose-800 flex items-start gap-2">
                      <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                      <span>The doctor replaced this prescription at {whenShort(replacedBy.prescribedAt)}. Do not hand over anything from this one.</span>
                    </div>
                    <button type="button" onClick={() => open(replacedBy)} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1 ml-auto">
                      Open the current prescription <ArrowRight size={13} />
                    </button>
                  </div>
                )}

                {/* 1 — Before handing over: seal, safety warnings, what to ask, patient identity */}
                <section aria-label="Before handing over">
                  <SectionTitle>{isOpen ? 'Before handing over' : 'Checks'}</SectionTitle>
                  <div className="rounded-xl border border-border/80 divide-y divide-border/60 overflow-hidden">
                    {sigState === 'checking' ? (
                      <CheckRow state="pending" title="Checking the doctor’s seal…" />
                    ) : sigState === 'valid' ? (
                      <CheckRow state="ok" title="Seal valid — unchanged since the doctor signed" />
                    ) : (
                      <div role="alert">
                        <CheckRow state="stop" title="Do not dispense until the doctor confirms this prescription">
                          <p className="font-semibold text-rose-800">Signature problem (seal broken): {(ver as { reason?: string })?.reason} It may have been changed after signing.</p>
                        </CheckRow>
                      </div>
                    )}

                    {earlier && (
                      <CheckRow state={earlierGiven ? 'warn' : 'info'} title={`Amended — replaces the prescription signed at ${whenShort(earlier.prescribedAt)}`}>
                        {earlierGiven
                          ? <p className="font-semibold text-amber-900">The earlier one was already recorded as “{STATUS_LABEL[earlier.dispenseStatus]?.text}”{earlier.dispensedBy ? ` by ${earlier.dispensedBy}` : ''}. Check what the patient already has before handing over more.</p>
                          : earlier.dispenseStatus === 'REFERRED_BACK' && earlier.dispenseNote
                            ? <p className="text-muted-foreground">It was sent back with the note: “{earlier.dispenseNote}”</p>
                            : <p className="text-muted-foreground">Nothing was handed over on the earlier one.</p>}
                      </CheckRow>
                    )}

                    {allergyList && allergyList.length > 0 && (
                      <CheckRow state="warn" title={<span className="text-rose-700">ALLERGY: {allergyList.join(', ')}</span>}>
                        <p className="text-muted-foreground">Checked against every medicine when the doctor signed. Confirm with the patient before handing over.</p>
                      </CheckRow>
                    )}

                    {warningCount === 0 ? (
                      <CheckRow state="ok" title={<>
                        {allergyList && allergyList.length === 0 ? 'No interaction or schedule warnings · no known allergies' : 'No interaction or schedule warnings'}
                        {renalMissing && <span className="block text-xs font-normal text-muted-foreground">Kidney dose adjustments were not checked (no kidney result on file).</span>}
                      </>} />
                    ) : (
                      <CheckRow state={unreasonedCritical ? 'stop' : 'warn'} title={`${warningCount} warning${warningCount > 1 ? 's' : ''} to check`}>
                        {criticalAlerts.length > 0 && (
                          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/40">
                            <div className="font-extrabold text-rose-700 flex items-center gap-1.5 mb-1"><AlertTriangle size={13} /> Serious alert{criticalAlerts.length > 1 ? 's' : ''} the doctor signed through</div>
                            {criticalAlerts.map((a, i) => <div key={`${a.groupKey || a.alertId}-${i}`} className="text-rose-900">{alertText(a)}</div>)}
                            {acknowledged.map(k => (
                              <div key={k.groupKey} className="mt-1.5 text-foreground bg-card/80 rounded-md px-2 py-1 border border-border"><strong>Doctor’s reason ({k.summary}):</strong> {k.reason}</div>
                            ))}
                            {!acknowledged.length && <div className="mt-1 font-semibold text-rose-800">No reason recorded — confirm with the doctor before dispensing.</div>}
                          </div>
                        )}
                        {warnAlerts.length > 0 && (
                          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/40 space-y-0.5">
                            {warnAlerts.map((a, i) => <div key={`${a.groupKey || a.alertId}-${i}`} className="text-amber-900">{alertText(a)}</div>)}
                          </div>
                        )}
                        {hasE1 && (
                          <div className="p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/40 font-semibold text-violet-900">
                            Schedule E(1): {e1Items.map(x => `${x.name} (${x.ingredients.join(', ')})`).join('; ') || 'Ayurvedic medicine with a poisonous ingredient'} — label “Caution: to be taken under medical supervision”; dispense only against this prescription and record the batch.
                          </div>
                        )}
                        {scheduleH1.length > 0 && (
                          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/40 font-semibold text-amber-900">
                            Enter in the Schedule H1 register (prescriber, patient, drug, quantity; keep 3 years): {scheduleH1.map(x => `${x.generic}${x.ndps ? ' — NDPS' : ''}`).join(', ')}
                          </div>
                        )}
                        {allergyList && allergyList.length === 0 && <p className="text-muted-foreground">No known allergies (asked at check-in).</p>}
                        {renalMissing && <p className="text-muted-foreground">Kidney dose adjustments were not checked (no kidney result on file).</p>}
                      </CheckRow>
                    )}
                    {infoAlerts.length > 0 && (
                      <details className="px-3 py-2 text-xs">
                        <summary className="cursor-pointer font-semibold text-muted-foreground">{infoAlerts.length} note{infoAlerts.length > 1 ? 's' : ''} for information</summary>
                        <div className="mt-1 space-y-0.5 text-muted-foreground">{infoAlerts.map((a, i) => <div key={`${a.groupKey || a.alertId}-${i}`}>{alertText(a)}</div>)}</div>
                      </details>
                    )}

                    {notChecked.length > 0 && (
                      <CheckRow state="warn" title="Not checked when the doctor signed">
                        <p className="text-amber-900"><strong>{notChecked.join(', ')}</strong> — not in the safety database, so interactions, dose and allergy were not checked for {notChecked.length > 1 ? 'these' : 'it'}.</p>
                      </CheckRow>
                    )}

                    {isOpen && sigState !== 'invalid' && toAsk.length > 0 && (
                      <CheckRow state="warn" title="Ask the patient before handing over">
                        {toAsk.map(q => <p key={q} className="text-amber-900">{q}</p>)}
                      </CheckRow>
                    )}

                    {isOpen && sigState !== 'invalid' && (
                      <label className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40">
                        <span className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${isIdentified ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-foreground/40 bg-background'}`}>
                          {isIdentified && <Check size={13} strokeWidth={3} />}
                          <input type="checkbox" className="sr-only" checked={isIdentified} onChange={() => { setIdentified(m => ({ ...m, [selected.id]: !m[selected.id] })); setActionError(''); }} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{isIdentified ? 'Patient confirmed — name and token match' : 'Confirm the patient — name and token'}</span>
                          <span className="block text-xs text-muted-foreground">Ask the patient to say their name; check the token on their slip or SMS: <span className="font-mono font-bold text-foreground">{selected.prescriptionToken}</span></span>
                        </span>
                      </label>
                    )}
                  </div>
                </section>

                {/* 2 — Pick. Ticks record what was picked; quantities are for the whole course. */}
                <section aria-label="Medicines">
                  <SectionTitle right={lines.length > 0 && canRecord ? <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{pickedHere.length} of {lines.length} picked</span> : undefined}>
                    {isOpen ? 'To hand over' : 'Medicines'} ({lines.length})
                  </SectionTitle>
                  {lines.length === 0 ? <p className="text-xs text-muted-foreground">No medicines on this prescription (advice only).</p> : (
                    <div className="rounded-xl border border-border/80 divide-y divide-border/60 overflow-hidden">
                      {lines.map((line, i) => {
                        const isPicked = pickedHere.includes(i);
                        const canTick = canRecord && !!line.name;
                        // On a recorded prescription: what the pharmacist recorded for this line.
                        const rec = !canRecord ? (selected.dispensedItems || []).find(g => norm(g.name) === norm(line.name)) : undefined;
                        return (
                          <div key={i} className={`px-3 py-2.5 ${isPicked ? 'bg-emerald-500/5' : ''} ${!line.name ? 'bg-amber-500/[0.06]' : ''}`}>
                            <label className={`flex items-start gap-3 ${canTick ? 'cursor-pointer' : ''}`}>
                              {canRecord && (
                                <span className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${isPicked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-foreground/40 bg-background'} ${canTick ? '' : 'opacity-40'}`}>
                                  {isPicked && <Check size={13} strokeWidth={3} />}
                                  <input type="checkbox" className="sr-only" checked={isPicked} disabled={!canTick} onChange={() => toggleIn(setPicked, i)} aria-label={`Picked ${line.name || 'unnamed line'}`} />
                                </span>
                              )}
                              {rec && (
                                <span className="mt-0.5 shrink-0" title={rec.given ? 'Given' : 'Not given'}>
                                  {rec.given ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-rose-600" />}
                                </span>
                              )}
                              <span className="mt-0.5 shrink-0" title={line.kind === 'ayush' ? 'Ayurvedic formulation' : 'Allopathic medicine'}>
                                {line.kind === 'ayush' ? <Leaf size={14} className="text-emerald-600" /> : <Pill size={14} className="text-sky-600" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                {line.name
                                  ? <span className="block text-sm font-bold text-foreground">{line.name}</span>
                                  : <span className="block text-sm font-bold text-amber-700">Name missing — confirm with the doctor</span>}
                                <span className="block text-xs text-muted-foreground">{line.detail || '—'}</span>
                                {line.instructions && <span className="block text-xs text-foreground/80 mt-0.5">“{line.instructions}”</span>}
                                {rec && <span className={`block text-xs font-semibold mt-0.5 ${rec.given ? 'text-emerald-700' : 'text-rose-700'}`}>{rec.given ? 'Given' : 'Not given'}{rec.given && rec.quantity ? ` · ${num(rec.quantity)}` : ''}{rec.batch ? ` · batch ${rec.batch}` : ''}</span>}
                                {line.alert && <LineTag tone={line.alert === 'stop' ? 'rose' : 'amber'}>{line.alert === 'stop' ? 'In a serious alert — see above' : 'In a warning — see above'}</LineTag>}
                                {line.look && <LineTag tone="amber">Look-alike name: this is {line.look.tallMan}, not {line.look.confusedWith.join(' or ')}</LineTag>}
                                {line.e1 && <LineTag tone="violet">Schedule E(1) — caution label</LineTag>}
                                {line.register && <LineTag tone="amber">{line.register} — register entry</LineTag>}
                              </span>
                              {line.qty !== null && line.name && (
                                <span className="shrink-0 text-right pl-1">
                                  <span className="block text-base font-extrabold tabular-nums leading-tight text-foreground">{num(line.qty)}</span>
                                  <span className="block text-[11px] text-muted-foreground">{line.qtyNote}</span>
                                </span>
                              )}
                            </label>
                            {canRecord && (line.e1 || line.register) && line.name && (
                              <div className="mt-2 ml-8 flex items-center gap-x-4 gap-y-2 flex-wrap">
                                {line.register && (
                                  <span className="flex items-center gap-2">
                                    <label htmlFor={`qty-${i}`} className="text-[11px] font-semibold text-muted-foreground">Quantity given</label>
                                    <input id={`qty-${i}`} inputMode="numeric" value={qtyHere[i] || ''} maxLength={5}
                                      onChange={e => { setQtyGiven(q => ({ ...q, [selected.id]: { ...(q[selected.id] || {}), [i]: e.target.value.replace(/[^\d.]/g, '') } })); setActionError(''); }}
                                      placeholder={line.qty !== null ? num(line.qty) : 'for the register'}
                                      className={`h-9 w-28 rounded-lg border bg-background px-2 text-sm font-bold tabular-nums ${line.qty === null && !qtyHere[i] ? 'border-amber-500/70' : 'border-border'}`} />
                                  </span>
                                )}
                                <span className="flex items-center gap-2">
                                  <label htmlFor={`batch-${i}`} className="text-[11px] font-semibold text-muted-foreground">Batch no.</label>
                                  <input id={`batch-${i}`} value={batchHere[i] || ''} maxLength={30}
                                    onChange={e => setBatch(b => ({ ...b, [selected.id]: { ...(b[selected.id] || {}), [i]: e.target.value } }))}
                                    placeholder="from the pack" className="h-9 w-44 rounded-lg border border-border bg-background px-2 text-sm font-mono" />
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {((selected.ongoingMedicines || []).length > 0 || selected.advice || selected.followUpDays) && (
                    <div className="mt-2 space-y-1 text-xs">
                      {selected.advice && <p><span className="text-muted-foreground">Doctor’s advice:</span> {selected.advice}</p>}
                      {!!selected.followUpDays && <p><span className="text-muted-foreground">Follow-up:</span> in {selected.followUpDays} day{selected.followUpDays === 1 ? '' : 's'}</p>}
                      {(selected.ongoingMedicines || []).length > 0 && (
                        <p className="text-muted-foreground">Patient’s own ongoing medicines (not dispensed here): {(selected.ongoingMedicines || []).map((m: any) => m.name || m.classicalName).join(', ')}</p>
                      )}
                    </div>
                  )}
                </section>
              </div>

              {/* 3 — Record what happened. Stays on screen while scrolling a long prescription. */}
              {!canRecord ? (
                !replacedBy && selected.dispenseStatus !== 'PENDING_VERIFICATION' && (
                  <div className="m-4 mt-0 px-3 py-2.5 rounded-xl bg-muted text-xs flex items-center justify-between gap-3 flex-wrap">
                    <span>
                      <strong>{STATUS_LABEL[selected.dispenseStatus]?.text}</strong>{selected.dispensedBy ? ` · ${selected.dispensedBy}` : ''}{selected.dispensedAt ? ` · ${whenFull(selected.dispensedAt)}` : ''}
                      {selected.dispenseNote ? <span className="text-muted-foreground"> — {selected.dispenseNote}</span> : null}
                    </span>
                    <button type="button" onClick={startCorrection} className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-card text-xs font-bold inline-flex items-center gap-1.5 ml-auto">
                      <PencilLine size={13} /> Correct this record
                    </button>
                  </div>
                )
              ) : (
                <div className="pharmacy-actions sticky bottom-0 border-t border-border/70 bg-card/95 backdrop-blur rounded-b-2xl px-4 py-3 space-y-2">
                  {correctingThis && <p className="text-xs font-bold text-foreground">Correcting the record — it replaces “{STATUS_LABEL[selected.dispenseStatus]?.text}”; the change is kept in the audit log.</p>}
                  <input value={note} onChange={e => { setNote(e.target.value); setActionError(''); }} maxLength={300}
                    placeholder={correctingThis ? 'What is being corrected, and why (required)' : someTicked ? `Note — left empty it records: Not given: ${notPicked.join(', ')}` : 'Note (needed if not everything was given, or to send it back)'}
                    aria-label="Dispensing note" className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className={`text-xs font-semibold min-h-[16px] ${actionError || sigState === 'invalid' || unreasonedCritical ? 'text-rose-700' : allGivenBlock ? 'text-muted-foreground' : 'text-emerald-700'}`} role="status" id="handover-status">
                      {actionError || allGivenBlock || 'Checks done — hand over and record.'}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap justify-end ml-auto">
                      {correctingThis && <button type="button" disabled={busy} onClick={() => { setCorrecting(null); setNote(''); setActionError(''); }} className="h-10 px-3 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground">Cancel</button>}
                      <button type="button" disabled={busy} onClick={() => record('REFERRED_BACK')} className={`h-10 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 ${sigState === 'invalid' || unreasonedCritical ? 'border-rose-500/60 text-rose-700 bg-rose-500/5 hover:bg-rose-500/10' : 'border-border bg-background hover:bg-muted'}`}>
                        <Undo2 size={14} /> Send back to doctor
                      </button>
                      <button type="button" disabled={busy || !!handOverBlock} aria-describedby="handover-status" onClick={() => record('PARTIAL')} className="h-10 px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed">
                        <PackageMinus size={14} /> Partly given
                      </button>
                      <button type="button" disabled={busy || !!allGivenBlock} aria-describedby="handover-status" onClick={() => record('DISPENSED')} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed">
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />} All given to patient
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* Labels */}
        <aside aria-label="Dose labels" className="pharmacy-pane rounded-2xl border border-border/80 bg-card p-3 flex flex-col gap-3">
          <SectionTitle>Dose labels</SectionTitle>
          {!selected ? <p className="text-xs text-muted-foreground -mt-2">Select a prescription.</p>
            : replacedBy ? <p className="text-xs text-muted-foreground -mt-2">No labels — this prescription was replaced.</p>
            : lines.length === 0 ? <p className="text-xs text-muted-foreground -mt-2">No medicines, so no labels.</p> : (
            <>
              <select value={labelLang} onChange={e => setLabelLang(e.target.value as RxLang)} aria-label="Label language" className="w-full h-10 rounded-lg border border-border bg-background px-2 text-sm -mt-1">
                {LABEL_LANGS.map(l => <option key={l} value={l}>{LANGUAGE_NATIVE_NAME[l]}{selected.language === l ? ' (patient\'s language)' : ''}</option>)}
              </select>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {lines.map((line, i) => !line.name ? (
                  <div key={i} className="rounded-lg border border-dashed border-amber-500/60 bg-amber-500/5 p-2 text-xs font-semibold text-amber-800">
                    Line {i + 1}: medicine name missing — no label printed.
                  </div>
                ) : (
                  <label key={i} className={`flex items-start gap-2 cursor-pointer ${skippedHere.includes(i) ? 'opacity-50' : ''}`}>
                    <input type="checkbox" className="mt-2 h-4 w-4 shrink-0 accent-sky-600" checked={!skippedHere.includes(i)} onChange={() => toggleIn(setSkipLabel, i)} aria-label={`Print label for ${line.name}`} />
                    <DoseLabel rx={selected} line={line} lang={labelLang} preview />
                  </label>
                ))}
              </div>
              {/* What actually prints: only named, ticked labels (the wrapper hides it on screen; the print copies the inner element). */}
              <div className="hidden" aria-hidden="true"><div ref={labelRef}>
                {printable.map(({ line, i }) => <DoseLabel key={i} rx={selected} line={line} lang={labelLang} />)}
              </div></div>
              <button type="button" disabled={!printable.length} onClick={() => { sovereignSound('shutter'); printElement(labelRef.current, `Labels — ${selected.patientName}`); }} className="w-full h-10 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-45">
                <Printer size={14} /> Print {printable.length} label{printable.length === 1 ? '' : 's'}
              </button>
              <p className="text-[11px] text-muted-foreground">Labels follow the doctor’s exact frequency and duration. Check each one against the prescription; untick any you will not print.</p>
            </>
          )}
        </aside>
      </div>
      {registerOpen && <H1RegisterDialog onClose={() => setRegisterOpen(false)} />}
    </div>
  );
};
